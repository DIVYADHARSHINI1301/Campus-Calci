import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

export const getAllRegNos = async () => {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    const regNos = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      regNos.push({
        id: doc.id,
        regNo: data.regNo,
        name: data.name,
        email: data.email
      });
    });
    console.log("All Registration Numbers in Database:", regNos);
    return regNos;
  } catch (error) {
    console.error("Error fetching regNos:", error);
    return [];
  }
};
