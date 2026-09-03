import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: 'petition' },
  value: { type: Number, required: true, default: 0 },
});

export const Counter = mongoose.model('Counter', counterSchema, 'Counter');
export default Counter;

export async function incrementCounter() {
  const doc = await Counter.findOneAndUpdate(
    { _id: 'petition' },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return doc.value;
}

export async function readCounter() {
  const doc = await Counter.findById('petition');
  return doc ? doc.value : 0;
}