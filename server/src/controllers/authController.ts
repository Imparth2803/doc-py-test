import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

import User from "../models/User";

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

console.log(
  "GOOGLE_CLIENT_ID:",
  process.env.GOOGLE_CLIENT_ID
);

export const googleLogin = async (
  req: Request,
  res: Response
) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log("PAYLOAD:", payload);

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
      });
    }

    const {
      sub,
      email,
      name,
      picture,
    } = payload;

    let user = await User.findOne({
      googleId: sub,
    });

    if (!user) {
      user = await User.create({
        googleId: sub,
        email,
        name,
        picture,
      });
    }
    console.log("USER FOUND/CREATED:",user);
    
    console.log("JWT_SECRET EXISTS:",!process.env.JWT_SECRET);

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.error(
      "Google Auth Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findById(
      userId
    ).select("-__v");

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "Get User Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};