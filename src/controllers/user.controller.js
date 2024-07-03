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

export { registerUser, loginUser, logoutUser, refreshAccessToken }
