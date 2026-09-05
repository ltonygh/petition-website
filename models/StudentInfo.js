import mongoose from 'mongoose';

const studentInfoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },
    studentID: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 8,
      minlength: 8,
      unique: true,
      index: true
    },

    major: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },
    
    cohort: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4,
      minlength: 4,
      match: /^\d{4}$/,
      validate: {
      validator: function(value) {
        const year = parseInt(value, 10);
        return year >= 2016 && year <= 2036;
      },
      message: props => `${props.value} is not a valid cohort year! Year must be between 2026 and 2036.`
  }
    },
    comments: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    signature: {
      type: String,
      required: true
    },
  }, {timestamps: true}
);

export const StudentInfo = mongoose.model('StudentInfo', studentInfoSchema);
export default StudentInfo;