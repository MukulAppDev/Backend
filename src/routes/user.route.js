import { Router } from "express";
import  { registerUser, loginUser, loggedoutUser, refreshAccessToken } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js";
import {verifyJWT} from '../middlewares/auth.middleware.js';

const router = Router();
// adding multer middleware for register route
router.route('/register').post(upload.fields([{
    name: "avatar",
    maxCount: 1
},{
    name : 'coverImage',
    maxCount:1
}]),registerUser);

router.route('/login').post(loginUser);

router.route('/loggout').post(verifyJWT,loggedoutUser);

router.route('/refresh-token').post(refreshAccessToken);


export default router;