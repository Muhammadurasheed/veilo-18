const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
require('dotenv').config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/veilo');

// Import User model
const User = require('../models/User');

const createAdminUser = async () => {
  try {
    console.log('🔄 Creating admin user...');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('❌ Admin user already exists:', existingAdmin.email);
      process.exit(1);
    }

    // Admin user details - using provided credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'yekinirasheed2002@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'mrash@veil01!';
    const adminAlias = process.env.ADMIN_ALIAS || 'Veilo Admin';

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Create admin user
    const adminUser = new User({
      id: `admin-${nanoid(8)}`,
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      alias: adminAlias,
      role: 'admin',
      isActive: true,
      emailVerified: true,
      avatarIndex: 1,
      createdAt: new Date(),
      lastLoginAt: new Date()
    });

    await adminUser.save();

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('🚨 IMPORTANT: Please change the password after first login!');
    console.log('🔗 Access admin panel at: /admin');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    mongoose.connection.close();
  }
};

createAdminUser();