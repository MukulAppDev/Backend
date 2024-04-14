import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from './app.js';

dotenv.config({
    path:'./env'
})
connectDB().then(()=>{
    app.listen(`${process.env.PORT}|| 8000`,()=>{
        console.log(`listen at the port ${process.env.PORT}`);
    });

    app.on('error',()=>{
        console.log('Getting Error on listing MongoDB at port 8000')
    })
    
}).catch((err)=>{
    console.log('MongoDB connection error',err);
});