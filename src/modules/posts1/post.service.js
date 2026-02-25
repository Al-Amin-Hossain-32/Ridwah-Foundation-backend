import Post from "./post.model.js";
import { getIO } from "../../config/socket.js";

/**
CREATE POST
*/
export const createPost=async(userId,data)=>{

 const post=await Post.create({
  author:userId,
  content:data.content,
  image:data.image||""
 });

 const populated=await post.populate("author","name profilePicture");

 getIO().emit("postCreated",populated);

 return populated;
};


/**
LIKE
*/
export const toggleLike=async(userId,postId)=>{

 const post=await Post.findById(postId);
 if(!post) throw Error("Post not found");

 const exists=post.likes.includes(userId);

 if(exists) post.likes.pull(userId);
 else post.likes.push(userId);

 await post.save();

 getIO().emit("postLiked",{
  postId,
  likes:post.likes.length,
  userId
 });

 return post;
};


/**
ADD COMMENT
*/
export const addComment=async(userId,postId,text)=>{

 const post=await Post.findById(postId);

 post.comments.push({
  user:userId,
  text
 });

 await post.save();

 const newComment=post.comments.at(-1);

 getIO().emit("commentAdded",{
  postId,
  comment:newComment
 });

 return newComment;
};


/**
ADD REPLY
*/
export const addReply=async(userId,postId,commentId,text)=>{

 const post=await Post.findById(postId);

 const comment=post.comments.id(commentId);

 comment.replies.push({
   user:userId,
   text
 });

 await post.save();

 const reply=comment.replies.at(-1);

 getIO().emit("replyAdded",{
   postId,
   commentId,
   reply
 });

 return reply;
};


/**
DELETE POST
*/
export const deletePost=async(userId,postId)=>{

 const post=await Post.findById(postId);

 if(post.author.toString()!==userId)
   throw Error("Unauthorized");

 await post.deleteOne();

 getIO().emit("postDeleted",{postId});

};