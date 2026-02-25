import express from "express";
import * as ctrl from "./post.controller.js";
import auth from "../../middlewares/auth.js";

const r=express.Router();

r.post("/",auth,ctrl.createPost);

r.post("/:postId/like",auth,ctrl.toggleLike);

r.post("/:postId/comment",auth,ctrl.addComment);

r.post("/:postId/comment/:commentId/reply",auth,ctrl.addReply);

r.delete("/:postId",auth,ctrl.deletePost);

export default r;