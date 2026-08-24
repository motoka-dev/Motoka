import React, { createContext, useState } from "react";

const ReminderContext = createContext();

export function ReminderProvider({ children }) {
  const [reminders] = useState([]);
  const [loading] = useState(false);

  // useEffect(() => {
  //   async function fetchReminders() {
  //     setLoading(true);
  //     try {
  //       const res = await api.get("/reminder");
  //       setReminders(res.data.data || []);
  //     } catch (e) {
  //       setReminders([]);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }
  //   fetchReminders();
  // }, []);

  return (
    <ReminderContext.Provider value={{ reminders, loading }}>
      {children}
    </ReminderContext.Provider>
  );
}