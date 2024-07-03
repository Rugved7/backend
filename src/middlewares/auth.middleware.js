import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import jwt from "jsonwebtoken"

export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        const tokenFromcookie = req.cookies?.accessToken
        const tokenFromHeader = req.header("Authorization")?.replace("Bearer ", "")
        const token = tokenFromcookie || tokenFromHeader
        console.log("Token", token);
        if (typeof token !== 'string') {
            throw new ApiError(401, "Invalid token type, string expected")
        }
        if (!token) {
            throw new ApiError(401, "Unauthorized request")
        }
        const decodedToken = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id).select("-password -refreshTokens")
        if (!user) {
            throw new ApiError(401, "Invalid Access Token")
        }
        req.user = user
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token")
    }
})

