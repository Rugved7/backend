import { v2 as cloudinary } from "cloudinary"
import fs from "fs"

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const fileUpload = async (Filepath) => {
  try {
    if (!Filepath) return null
    const response = await cloudinary.uploader.upload(Filepath, {
      resource_type: "auto",
    })
    fs.unlinkSync(Filepath)
    // File has been uploaded
    console.log("File uploaded Successfully", response.url)
    return response
  } catch (error) {
    fs.unlinkSync(Filepath)
    return null
  }
}

export { fileUpload }
