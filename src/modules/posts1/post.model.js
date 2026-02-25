import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
{
  user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
  text:String
},{timestamps:true}
);

const commentSchema=new mongoose.Schema(
{
 user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
 text:String,
 replies:[replySchema]
},{timestamps:true}
);

const postSchema=new mongoose.Schema(
{
 author:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
 content:String,
 image:String,

 likes:[
   {type:mongoose.Schema.Types.ObjectId,ref:"User"}
 ],

 comments:[commentSchema]

},{timestamps:true});

export default mongoose.model("Post",postSchema);