import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

import User from "../models/User";

const cleanClientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
const cleanSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";

const client = new OAuth2Client({
  clientId: cleanClientId,
  clientSecret: cleanSecret,
  redirectUri: 'postmessage',
});

console.log(
  "GOOGLE_CLIENT_ID:",
  process.env.GOOGLE_CLIENT_ID
);

export const googleLogin = async (
  req: Request,
  res: Response
) => {
  try {
    const { credential, code } = req.body;

    if (!credential && !code) {
      return res.status(400).json({
        success: false,
        message: "Google credential or authorization code is required",
      });
    }

    let payload;
    let accessToken;
    let refreshToken;

    if (code) {
      // Exchange code for tokens
      let tokens;
      try {
        const response = await client.getToken({
          code,
          redirect_uri: 'postmessage'
        });
        tokens = response.tokens;
      } catch (err) {
        console.error("Google code exchange error:", err);
        if (err && typeof err === 'object' && 'response' in err) {
          console.error("[GOOGLE_REJECTION_DETAILS]:", (err as any).response?.data);
        }
        return res.status(400).json({
          success: false,
          message: "Google code exchange failed or token expired."
        });
      }

      accessToken = tokens.access_token || undefined;
      refreshToken = tokens.refresh_token || undefined;

      if (!tokens.id_token) {
        return res.status(401).json({
          success: false,
          message: "No ID Token returned from Google code exchange",
        });
      }

      try {
        const ticket = await client.verifyIdToken({
          idToken: tokens.id_token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (err) {
        console.error("Google ID Token verification error:", err);
        return res.status(400).json({
          success: false,
          message: "Google code exchange failed or token expired."
        });
      }
    } else {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    }

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
        googleAccessToken: accessToken,
        googleRefreshToken: refreshToken,
      });
    } else {
      // Update tokens on login
      if (accessToken) user.googleAccessToken = accessToken;
      if (refreshToken) user.googleRefreshToken = refreshToken;
      await user.save();
    }
    console.log("USER FOUND/CREATED:", user);
    
    console.log("JWT_SECRET EXISTS:", !process.env.JWT_SECRET);

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
  } catch (error: any) {
    console.error('Google Auth Error:', error?.message || error);
    console.error('Google Auth Error Detail:', error?.response?.data || JSON.stringify(error, null, 2));
    return res.status(500).json({
      success: false,
      message: error?.message || 'Authentication failed',
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

export const getGoogleToken = async (
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      accessToken: user.googleAccessToken || "",
    });
  } catch (error: any) {
  console.error("Google Auth Error:", error?.message || error);  // already there
  console.error("Full error:", JSON.stringify(error, null, 2));  // add this line
  return res.status(500).json({
    success: false,
    message: error?.message || "Authentication failed",  // return real message
  });
}
};