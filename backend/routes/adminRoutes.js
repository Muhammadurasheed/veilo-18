
const express = require('express');
const router = express.Router();
const Expert = require('../models/Expert');
const Post = require('../models/Post');
const User = require('../models/User');
const SanctuarySession = require('../models/SanctuarySession');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Get all unverified experts
// GET /api/admin/experts/unverified
router.get('/experts/unverified', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const experts = await Expert.find({ verified: false });
    
    res.json({
      success: true,
      data: experts
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Verify expert
// PATCH /api/admin/experts/:id/verify
router.patch('/experts/:id/verify', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { verificationLevel, status, feedback } = req.body;
    
    // Validation
    if (!verificationLevel || !status) {
      return res.status(400).json({
        success: false,
        error: 'Verification level and status are required'
      });
    }
    
    const expert = await Expert.findOne({ id: req.params.id });
    
    if (!expert) {
      return res.status(404).json({
        success: false,
        error: 'Expert not found'
      });
    }
    
    // Update expert
    expert.verificationLevel = verificationLevel;
    expert.verified = status === 'approved';
    expert.accountStatus = status;
    
    // Update all documents to approved/rejected
    expert.verificationDocuments.forEach(doc => {
      doc.status = status;
    });
    
    await expert.save();
    
    res.json({
      success: true,
      data: {
        success: true
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Verify expert with enhanced feedback
// PATCH /api/admin/experts/:id/verify
router.patch('/experts/:id/verify', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { verificationLevel, status, feedback } = req.body;
    
    // Validation
    if (!verificationLevel || !status) {
      return res.status(400).json({
        success: false,
        error: 'Verification level and status are required'
      });
    }
    
    const expert = await Expert.findOne({ id: req.params.id });
    
    if (!expert) {
      return res.status(404).json({
        success: false,
        error: 'Expert not found'
      });
    }
    
    // Update expert with enhanced tracking
    expert.verificationLevel = verificationLevel;
    expert.verified = status === 'approved';
    expert.accountStatus = status;
    expert.verificationFeedback = feedback;
    expert.verifiedAt = status === 'approved' ? new Date() : null;
    expert.verifiedBy = req.user.id;
    
    // Update all documents to approved/rejected
    expert.verificationDocuments.forEach(doc => {
      doc.status = status;
      doc.reviewedAt = new Date();
      doc.reviewedBy = req.user.id;
    });
    
    await expert.save();
    
    // Log the verification action
    console.log(`Expert ${expert.id} ${status} by admin ${req.user.id}`);
    
    res.json({
      success: true,
      data: {
        success: true,
        expert: {
          id: expert.id,
          alias: expert.alias,
          verified: expert.verified,
          accountStatus: expert.accountStatus,
          verificationLevel: expert.verificationLevel
        }
      }
    });
  } catch (err) {
    console.error('Expert verification error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Server error during expert verification'
    });
  }
});

// Get all experts (for admin)
// GET /api/admin/experts
router.get('/experts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const experts = await Expert.find();
    
    res.json({
      success: true,
      data: experts
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Get all flagged content
// GET /api/admin/flagged
router.get('/flagged', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const posts = await Post.find({ flagged: true });
    
    res.json({
      success: true,
      data: {
        posts
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Resolve flagged content
// POST /api/admin/flagged/:id
router.post('/flagged/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { action } = req.body;
    
    if (!action || !['approve', 'remove'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Valid action is required (approve or remove)'
      });
    }
    
    const post = await Post.findOne({ id: req.params.id, flagged: true });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Flagged post not found'
      });
    }
    
    if (action === 'approve') {
      // Unflag post
      post.flagged = false;
      post.flagReason = null;
      await post.save();
    } else {
      // Remove post
      await Post.deleteOne({ id: req.params.id });
    }
    
    res.json({
      success: true,
      data: {
        success: true
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Admin login with proper authentication
// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Find user with admin role
    const user = await User.findOne({ 
      email: email.toLowerCase(), 
      role: 'admin',
      isActive: true
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Verify password with bcrypt
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Update last login
    user.lastLoginAt = new Date();
    await user.save();
    
    // Create secure payload
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        alias: user.alias
      }
    };
    
    // Generate JWT token
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          alias: user.alias,
          role: user.role,
          avatarIndex: user.avatarIndex
        }
      }
    });
  } catch (err) {
    console.error('Admin login error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
});

// Admin logout (optional - client-side token removal is sufficient)
// POST /api/admin/logout
router.post('/logout', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // In a more sophisticated setup, you could blacklist the token
    // For now, we'll just confirm logout
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('Admin logout error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Server error during logout'
    });
  }
});

// Get admin profile
// GET /api/admin/profile
router.get('/profile', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id }).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Admin user not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        alias: user.alias,
        role: user.role,
        avatarIndex: user.avatarIndex,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (err) {
    console.error('Get admin profile error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving profile'
    });
  }
});

module.exports = router;
