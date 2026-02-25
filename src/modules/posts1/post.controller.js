import * as service from "./post.service.js";

export const createPost=async(req,res)=>{
 try{
  const data=await service.createPost(req.user.id,req.body);
  res.json(data);
 }catch(e){
  res.status(500).json({message:e.message});
 }
};

export const toggleLike=async(req,res)=>{
 try{
  const data=await service.toggleLike(
   req.user.id,
   req.params.postId
  );
  res.json(data);
 }catch(e){
  res.status(500).json({message:e.message});
 }
};

export const addComment=async(req,res)=>{
 try{
  const data=await service.addComment(
   req.user.id,
   req.params.postId,
   req.body.text
  );
  res.json(data);
 }catch(e){
  res.status(500).json({message:e.message});
 }
};

export const addReply=async(req,res)=>{
 try{
  const data=await service.addReply(
   req.user.id,
   req.params.postId,
   req.params.commentId,
   req.body.text
  );
  res.json(data);
 }catch(e){
  res.status(500).json({message:e.message});
 }
};

export const deletePost=async(req,res)=>{
 try{
  await service.deletePost(
    req.user.id,
    req.params.postId
  );
  res.json({success:true});
 }catch(e){
  res.status(500).json({message:e.message});
 }
};