import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { User } from "../models/user.model.js"
import { fileUpload } from "../utils/cloudinary.js"

// Generate Access and Refresh Tokens
const generateAccessAndRefreshTokens = async(userId) => {
  try {
   const user = await User.findById(userId)
   const accessToken = user.generateAccessToken()
   const refreshToken = user.generateRefreshToken()

   user.refreshToken = refreshToken
   await user.save({validateBeforeSave:false})
   return {accessToken,refreshToken}
    
  } catch (error) {
    throw new ApiError(500,"Internal server Error: Error while genereting Access pr Refresh Token")
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
const loginUser = (async(req,res)=>{
  const { email, password, userName } = req.body
  if (!email || !userName) {
    throw new ApiError(400, "Username or email is Required")
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
  const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)
  const loggedInuser = await User.findById(user._id).select("-password -refreshTokens")
  // send access and refresh tokens in cookies
  const cookieOptions = {
    httpOnly:true,
    secure:true
  }
  return res
  .status(200)
  .cookie("accessToken",accessToken,cookieOptions)
  .cookie("refreshToken",refreshToken,cookieOptions)
  .json(
    200,{
      user:loggedInuser,accessToken,refreshToken
    },
    "User Logged In SuccessFully"
  )
})

// Logout 
const logoutUser = asyncHandler(async(req,res)=>{
  
})

export { registerUser, loginUser , logoutUser}
