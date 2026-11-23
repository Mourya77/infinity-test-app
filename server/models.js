const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
}, { timestamps: true });

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], required: true, validate: v => v.length === 4 },
  correctAnswer: { type: Number, required: true, min: 0, max: 3 },
  explanation: { type: String, default: '' },
  category: { type: String, default: 'General' },
}, { timestamps: true });

const attemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [{ questionId: String, selected: { type: Number, default: -1 }, correct: Boolean, correctAnswer: Number }],
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  durationSeconds: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = {
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Question: mongoose.models.Question || mongoose.model('Question', questionSchema),
  Attempt: mongoose.models.Attempt || mongoose.model('Attempt', attemptSchema),
};
