import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import asyncHandler from '../utils/asynchHandler.js'
import ApiError from '../utils/ApiError.js';

/* we had replace res with _ , it a practice used in production when we dont required any option from req and res 
that will be replaced by _ */
export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookie?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) throw new ApiError("401", "user in not authorized");

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }

    req.user = user;

    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
