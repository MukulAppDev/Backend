const asynchHandler = (requestHandler)=>{
    return (req,res,next) =>{
        Promise.resolve(requestHandler(req,res,next)).catch((err) => next(err))
    }
}

export default asynchHandler;


// const asynchHandler = (fn)=> async(req,res,next)=>{
//     try{
//         await fn(req,res,next);
//     }
//     catch(err){
//         res.status(err.code || 500).json({
//             success:false,
//             message : err.message
//         })
//     }
// }