import axios from "axios";

const BASE_URL =
  process.env.API_BASE_URL ||
  "https://t4e-testserver.onrender.com/api";

export const getToken = async () => {
  const { data } = await axios.post(
    `${BASE_URL}/public/token`,
    {
      studentId: process.env.STUDENT_ID,
      password: process.env.PASSWORD,
      set: process.env.SET_NAME,
    }
  );

  return data;
};

export const getDataset = async (token, dataUrl) => {
  const { data } = await axios.get(
    `${BASE_URL}${dataUrl}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return data.data;
};