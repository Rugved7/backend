import express, { json, urlencoded } from "express"
import cookieParser from "cookie-parser"
import cors from "cors"

const app = express()

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
)

app.use(
  express.json({
    limit: "32kb",
  })
)

// Middlewares
app.use(urlencoded({ extended: true, limit: "32kb" }))
app.use(express.static("public"))
app.use(cookieParser())

// Route import
import userRouter from "./routes/user.routes.js"

app.use("/api/v1/users", userRouter)

export { app }
