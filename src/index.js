import dotenv from "dotenv"
import connectDB from "./database/db.js"
import { app } from "./app.js"

dotenv.config({
  path: "./env",
})

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 5050, () => {
      console.log(`Server Connection Eastablished`)
    })
  })
  .catch((err) => {
    console.log(`Server Connection Failed`, err)
    throw err
  })
