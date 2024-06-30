import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { User } from "../models/user.model.js"
import { fileUpload } from "../utils/cloudinary.js"

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
  const existingUser = User.findOne({
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
  const createdUser = await User.findById(_id).select(
    "-password -refreshTokens"
  )
  if (!createdUser) {
    throw new ApiError(500, "Cannot Register User,Something went wrong")
  }
  // All Good , return the user
  const response = await res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"))
  return response
})

export { registerUser }
