import mongoose, { Schema, model } from 'mongoose';
import 'dotenv/config';

const StudentSchema = new Schema({ name: String, grade: String });
const TeacherSchema = new Schema({ name: String, subject: String });
const CourseSchema = new Schema({ name: String, teacher: String });

const Student = model('Student', StudentSchema);
const Teacher = model('Teacher', TeacherSchema);
const Course = model('Course', CourseSchema);

async function seed() {
    await mongoose.connect(process.env.DB_URL!);
    console.log('Connected to DB');

    await Student.deleteMany({});
    await Teacher.deleteMany({});
    await Course.deleteMany({});

    await Student.insertMany([{ name: '김철수', grade: '고1' }, { name: '이영희', grade: '고2' }]);
    await Teacher.insertMany([{ name: '박선생', subject: '수학' }, { name: '최선생', subject: '영어' }]);
    await Course.insertMany([{ name: '수학기초', teacher: '박선생' }, { name: '영어회화', teacher: '최선생' }]);

    console.log('Database seeded');
    await mongoose.disconnect();
}

seed();
