import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { User } from "../models/user.model.js"
import { fileUpload } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"

// Generate Access and Refresh Tokens
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })
    return { accessToken, refreshToken }

  } catch (error) {
    throw new ApiError(500, "Internal server Error: Error while genereting Access & Refresh Token")
  }
}

const registerUser = asyncHandler(async (req, res) => {
  // get User from Frontend
  const { fullName, userName, email, password } = req.body
  // check if any field is empty
  if (
    [fullName, userName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All Fields are compulsory")
  }
  // check if user already exists
  const existingUser = await User.findOne({
    $or: [{ userName }, { email }],
  })
  if (existingUser) {
    throw new ApiError(409, "User with same username or email exists ")
  }
  // check for filupload(avatar and coverimage)
  const avatarLocalPath = req.files?.avatar[0].path
  const coverImagePath = req.files?.coverImage[0]?.path

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar File is Required")
  }
  const avatar = await fileUpload(avatarLocalPath)
  const coverImage = await fileUpload(coverImagePath)
  if (!avatar) {
    throw new ApiError(400, "Avatar File is Required")
  }
  // create user after registering
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  })
  // check if user is created or not
  const createdUser = await User.findById(user._id).select(
    "-password -refreshTokens"
  )
  if (!createdUser) {
    throw new ApiError(500, "Cannot Register User,Something went wrong")
  }
  // All Good , return the user
  return await res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"))
})



// Login User
const loginUser = asyncHandler(async (req, res) => {
  const { email, password, userName } = req.body
  if (!(email || userName)) {
    throw new ApiError(400, "Email is Required")
  }
  const user = await User.findOne({
    $or: [{ userName }, { email }],
  })
  if (!user) {
    throw new ApiError(404, "Username or email not found")
  }
  const isPasswordValid = await user.isPasswordCorrect(password)
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid User Credentials")
  }
  // Access and Refresh Tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
  const loggedInUser = await User.findById(user._id).select("-password -refreshTokens")
  // send access and refresh tokens in cookies
  const options = {
    httpOnly: true,
    secure: true
  }
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200, {
        user: loggedInUser, accessToken, refreshToken
      },
        "User Logged In SuccessFully"
      )
    )

})

// Logout ---> delete refreshtoken and cookies
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1
      }
    },
    {
      new: true
    }
  )
  const options = {
    httpOnly: true,
    secure: true
  }
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out Successfully"))
})

// This refreshToken will be deliverd to user when there Refresh tokens are about || has expired
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request")
  }
  try {
    const decodedRefreshToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )
    const user = await User.findById(decodedRefreshToken?._id)
    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token")
    }
    if (incomingRefreshToken !== user?.refreshTokens) {
      throw new ApiError(401, "Refresh Token is Expired or Invalid")
    }
    // if everything is okay --> generate new tokens
    const options = {
      httpOnly: true,
      secure: true
    }
    const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        200,
        {
          accessToken, refreshToken: newRefreshToken
        },
        "New Refresh Token Granted"
      )
  } catch (error) {
    throw new ApiError(500, error?.message || "Internal Server Error")
  }
})


// Change Password
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body

  if (!(newPassword === confirmPassword)) {
    throw new ApiError(400, "New Password and Confirm Password should be same")
  }

  const user = await User.findById(req.user?._id) // we have created a method that wrapped it in req.user in logout middleware, that we have used here to search for id 
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword) // isPasswordCorrect method is made in user.model.js
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Password")
  }
  user.password = newPassword
  await user.save({ validateBeforeSave: true })

  return res
    .status(200)
    .json(
      new ApiResponse(200, {}, "Password Changed Successfully")
    )
})

// Get current user
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(200, req.user, "Current User fetched Successfully")
    )
})

// update Account details
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { email, fullName } = req.body
  if (!(email || fullName)) {
    throw new ApiError(400, "No email or fullName recieved")
  }
  const user = await User.findByIdAndUpdate(req.user._id,
    {
      $set: {
        fullName,
        email
      }
    },
    { new: true }
  ).select("-password")
  if (!user) {
    throw new ApiError(400, "User not found")
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, "Account details Updated")
    )
})

// Update Avatar
const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req?.file.path

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar File Path is missing")
  }

  const avatar = await fileUpload(avatarLocalPath)
  if (!avatar.url) {
    throw new ApiError(400, "Error while updating avatar on cloudinary")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    { new: true }
  ).select("-password")

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, "Avatar updated SUccessfully")
    )
})


// update CoverImage
const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req?.file.path

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image Path is missing")
  }

  const coverImage = await fileUpload(coverImageLocalPath)
  if (!coverImage.url) {
    throw new ApiError(400, "Error while updating CoverImage on cloudinary")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    },
    { new: true }
  )

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, "CoverImage updated SUccessfully")
    )
})

// MongoDB Aggregation pipelines 
const getChannelProfile = asyncHandler(async (req, res) => {
  const { userName } = req.params

  if (!userName?.trim()) {
    throw new ApiError(400, "Username not found")
  }
  const channel = await User.aggregate([
    {
      $match: {
        userName: userName?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions", // lowercase because mongodb saves all docs in lowercase
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscribers",
        as: "subscriberdTo"
      }
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers"
        },
        channelSubscribedToCount: {
          $size: "subscriberdTo"
        },
        isSubscribed: { // to know whether the users is subscribed the profile nor not 
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false
          }
        }
      }
    },

    // Project pipline delivers the deliverable to the frontend
    {
      $project: {
        fullName: 1,
        userName: 1,
        email: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
      }
    }
  ])
  if (!channel?.length) {
    throw new ApiError(404, "Channel Does not Exist")
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "channel Data fetched Succesfully")
    )
})

export { registerUser, loginUser, logoutUser, refreshAccessToken, changePassword, getCurrentUser, updateAccountDetails, updateAvatar, updateCoverImage, getChannelProfile }
