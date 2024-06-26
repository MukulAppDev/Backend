import asynchHandler from "../utils/asynchHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import fs from "fs";

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user?.generateAccessToken();
    const refreshToken = user?.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

const removeImageFilelocal = (localFilePath)=>{
  return localFilePath && fs.unlinkSync(localFilePath)
}

const registerUser = asynchHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  const { fullName, email, username, password } = req.body;

  if (
    [fullName, email, username, password].some((feild) => feild?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const exisitingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (exisitingUser)
    throw new ApiError(409, "User with email or username is already exists");

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath =
    req &&
    req?.files &&
    Array.isArray(req?.files?.coverImage) &&
    req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) throw new ApiError(400, "Avatar file is required");

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) throw new ApiError(400, "Avatar file is required");

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser)
    throw new ApiError(500, "Something went wrong while registering user");

  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User registered succesfully."));
});

const loginUser = asynchHandler(async (req, res) => {
  // req body -> data
  // username or email
  // find the user
  // password check
  // access and refresh token
  // send cookie

  const { username, password, email } = req.body;

  if (!(username || !email)) {
    throw new ApiError(400, "Please provide either username or email");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) throw new ApiError(401, "Invalid user credentials");

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // option for cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const loggedoutUser = asynchHandler(async (req, res) => {
  const _user = await User.findByIdAndUpdate(
    req.user._id,
    // {
    //   $set:{
    //     refreshToken:undefined
    //   }
    // },
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true, // this will ensure you will get user detail after updation
    }
  );

  const option = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asynchHandler(async (req, res) => {
  // get the refresh token
  // validate refresh token
  // decode refresh token to get user id
  // using user id get the user details from db
  // return response to user with update refresh and access token

  const incomingRefreshToken =
    req.cookie?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) throw new ApiError(401, "unauthorized request");

  const decodedToken = await jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  if (!decodedToken) throw new ApiError(401, "unauthorized request");

  const user = await User.findById(decodedToken?._id);

  if (!user) throw new ApiError(401, "Invalid refresh token");

  // do we really required this step
  if (incomingRefreshToken !== user?.refreshToken)
    throw new ApiError(401, "Refresh token is expired or used");

  const { accessToken, newRefreshToken } = generateAccessAndRefereshTokens(
    user._id
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "Access token refreshed"
      )
    );
});

const changeCurrentPassword = asynchHandler(async (req, res) => {
  // will take newPassword and oldPassword from req body
  // validate if the newPassword is correct => by isPasswordCorrect
  // as we had used verifyJWT middle for this controller we get the user id in req object
  // then fetch the user from db
  // update the password of user and save it
  // return response to user

  const { oldPassword, newPassword } = req.body;

  if (!oldPassword && !newPassword)
    throw new ApiError(400, "Invalid old password");

  const user = await User.findById(req.user?._id);

  if (!user) throw new ApiError(401, "invalid user");

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) throw new ApiError(400, "Invalid old password");

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password updated succesfully"));
});

const getCurrentUser = asynchHandler(async (req, res) => {
  // using middleware(auth.middleware) we are getting user so we can directly return it to user
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user details"));
});

const updateAccountDetails = asynchHandler(async (req, res) => {
  // get the feild required to update
  // validate the feilds are required
  // update the feilds in db
  // return response with updated feilds
  const { fullName, email } = req.body;

  if (!fullName || !email) throw new ApiError(400, "All feilds required");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { fullName, email },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");

  if (!user) throw new ApiError(400, "Invalid user");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asynchHandler(async (req, res) => {
  // we required avtar from user , that we can get using multer
  // validate the local path
  // upload on cloudinary
  // validate is uploade on cloudanary
  // then update db with new path
  // return user

  // we had used req.file instead of files in regestration request , because here we are just expecting one single file for avtar
  const avatarLocalPath = req.file.avatar?.path;

  if (!avatarLocalPath) throw new ApiError(400, "Avatar file is missing");

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) throw new ApiError(400, "Error while uploading on avatar");

  removeImageFilelocal(avatarLocalPath);

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select('-password -refreshToken');

  if (!user) throw new ApiError(400, "Invalid user");

  return req.status(200).json(new ApiResponse(200,user,'Avtar image updated succesfully'))

});

const updateUserCoverImage = asynchHandler(async (req, res) => {
  // we required avtar from user , that we can get using multer
  // validate the local path
  // upload on cloudinary
  // validate is uploade on cloudanary
  // then update db with new path
  // return user

  // we had used req.file instead of files in regestration request , because here we are just expecting one single file for avtar
  const coverImageLocalPath = req.file.avatar?.path;

  if (!coverImageLocalPath) throw new ApiError(400, "Cover file is missing");

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) throw new ApiError(400, "Error while uploading on coverImage");

  removeImageFilelocal(coverImageLocalPath);

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select('-password -refreshToken');

  if (!user) throw new ApiError(400, "Invalid user");

  return req.status(200).json(new ApiResponse(200,user,'Cover image updated succesfully'))

});

export {
  registerUser,
  loginUser,
  loggedoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage
};
