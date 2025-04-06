import config from "./config";  // ✅ Import Config
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Login from "./Login";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { io } from "socket.io-client";
import { DateTime } from "luxon";
import UpdatePasswordModal from './UpdatePasswordModal';
const BASE_URL = config.BASE_URL;  // ✅ Use BASE_URL from config
const socket = io(BASE_URL, {
  transports: ["websocket", "polling"],  // ✅ Ensures WebSocket connection
}); // 🔹 Connect to WebSocket Server

const App = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
 //const [history, setHistory] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
// 🟢 Add User Form State
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "" });
  const [generatedPassword, setGeneratedPassword] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isOnlineUsersOpen, setIsOnlineUsersOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [editEntry, setEditEntry] = useState(null);
  const [userId, setUserId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const handleEdit = (entry) => {
    console.log("Editing entry:", entry); // Debugging: Check if entry has `id`
    if (!entry || !entry.id){
      console.error("❌ Error: ID is missing in entry", entry);
      return;
    }
    setEditEntry(entry);
};
// const Header = ({ username }) => {
//   const [showModal, setShowModal] = useState(false);
//   const [oldPassword, setOldPassword] = useState("");
//   const [newPassword, setNewPassword] = useState("");

//   const handlePasswordUpdate = async () => {
//     if (!user?.id) {
//       console.error("User ID is missing!");
//       return;
//     }
//     try {
      
//       const res = await fetch(`${process.env.REACT_APP_API_URL}/update-password`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${localStorage.getItem("token")}`,
//         },
//         body: JSON.stringify({ user_id: user.id, oldPassword, newPassword }),
//       });

//       const data = await res.json();
//       if (res.ok) {
//         alert("Password updated successfully!");
//         setShowModal(false);
//       } else {
//         alert(data.error || "Failed to update password.");
//       }
//     } catch (error) {
//       alert("Something went wrong. Try again!");
//     }
//   }};

  const handleShowModal = () => {
    setShowModal(true);
};
const handleClose = () => {
  setEditEntry(null);
};


// ✅ Function to Save Edited Check-Out Time
const handleSave = async () => {
  if (!editEntry || !editEntry.id || !editEntry.checkout_time) {
      alert("Please select a check-out time!");
      return;
  }
// Convert checkout_time to "YYYY-MM-DD HH:MM:SS"
const dateObj = new Date(editEntry.checkout_time);
const formattedCheckoutTime = dateObj.getFullYear() +
    "-" + String(dateObj.getMonth() + 1).padStart(2, '0') +
    "-" + String(dateObj.getDate()).padStart(2, '0') +
    " " + String(dateObj.getHours()).padStart(2, '0') +
    ":" + String(dateObj.getMinutes()).padStart(2, '0') +
    ":" + String(dateObj.getSeconds()).padStart(2, '0');
  console.log("🛠 Sending Update Request:", {
      id: editEntry.id,
      checkout_time: editEntry.formattedCheckoutTime
  });

  try {
      // Capture response from API
      const response = await axios.put(`${BASE_URL}/check/update-checkout/${editEntry.id}`, {
          checkout_time: formattedCheckoutTime
      });

      console.log("✅ Update Success:", response.data);
      alert("✅ Check-Out Time Updated!");

      setEditEntry(null);
      fetchHistory(); // Refresh data
  } catch (error) {
      console.error("❌ Error updating check-out time:", error);
      alert("❌ Failed to update check-out time. Check console for details.");
  }
};
 
  // 🟢 Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setIsCheckedIn(false);
  };

  // 🟢 Decode Token on Load
  useEffect(() => {
    try {
      const decoded = jwtDecode(token);
      if (!decoded.id) throw new Error("Invalid Token Structure");
      setUser({
        id: decoded.id,
        name: decoded.name || "User",
        email: decoded.email || "",
      });
      setUserId(decoded.id);
    } catch (error) {
      console.error("Token error:", error);
      handleLogout();
    }
  }, [token]);

  // 🟢 Function: Check User Status (Throttle to avoid excessive API calls)
  const checkUserStatus = useCallback(async (userId) => {
    if (!userId) return;

    try {
      const res = await axios.get(`${BASE_URL}/check/check-status/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsCheckedIn(res.data.isCheckedIn);
    } catch (error) {
      console.error("Error checking user status:", error);
    }
  }, [token]);

  // 🟢 Listen for Check-In Notifications
  useEffect(() => {
  if (socket) {
    socket.on("newCheckIn", (data) => {
      setNotifications((prev) => [data.message, ...prev]);
    });

    return () => {
      socket.off("newCheckIn");
    };
  }
},[]);

  // 🕒 Polling Mechanism (Runs every 10s to reduce API load)
  useEffect(() => {
    if (user?.id) {
      checkUserStatus(user.id); // Run once initially
      const interval = setInterval(() => checkUserStatus(user.id), 10000); // Every 10 seconds

      return () => clearInterval(interval); // Cleanup on unmount
    }
  }, [user?.id, checkUserStatus]);

  // 🟢 Fetch Users (Excludes admin email)
  const fetchUsers = useCallback(async () => {
    try {
      console.log("BASE_URL:", BASE_URL);
      const res = await axios.get(`${BASE_URL}/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.data || res.data.length === 0) {
        console.warn("No users found!");
        return;
      }
      const filteredUsers = res.data.filter((u) => u.email !== "mdhassan.qa90@gmail.com");
      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, [token]);

  // 🟢 Runs only when token changes (or on first load)
  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        console.log("Decoded User:", decoded);
        setUser({
          id: decoded.id,
          name: decoded.name || "User",
          email: decoded.email || "",
        });

        checkUserStatus(decoded.id);

        // Fetch users only if logged-in user is admin
        if (decoded.name === "Md Hassan") {
          fetchUsers();
        }
      } catch (error) {
        console.error("Invalid token:", error);
        handleLogout();
      }
    }
  }, [token, checkUserStatus, fetchUsers]);

  // 🟢 Handle Check-In/Check-Out
  const handleCheckInOut = async () => {
    if (!user?.id) {
      console.error("User ID is missing!");
      return;
    }

    try {
      const action = isCheckedIn ? "checkout" : "checkin";
      const response = await axios.post(
        `${BASE_URL}/check/${action}`,
        { user_id: user.id }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("Check-In/Check-Out Response:", response.data);

      if (action === "checkout") {
        handleLogout(); // ✅ Logout on Check Out
      } else {
        setIsCheckedIn(true);
      }
    } catch (error) {
      console.error("Error:", error.response?.data || error.message);
    }
  };

  // 🟢 Fetch History of Selected User
  const fetchHistory = useCallback(async () => {
    if (!selectedUser && !fromDate && !toDate) {
      alert("Please select a user and provide a date range!");
      return;
    }
    try {
      const res = await axios.get(`${BASE_URL}/check/history/`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {user_id: selectedUser, start_date: fromDate, end_date:toDate },
      });
      console.log("API Response:", res.data);
      if (!Array.isArray(res.data)) {
        console.error("❌ Expected an array but got:", res.data);
        return;
      }
      setHistoryData(res.data);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  },[selectedUser, fromDate, toDate, token]);
  useEffect(() => {
  }, []);

  // 🟢 Add New User
  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email) {
      alert("Please enter Name and Email");
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();
      if (response.ok) {
        setGeneratedPassword(data.generatedPassword); // 🔹 Store generated password
        alert("User Registered Successfully!");
        setNewUser({ name: "", email: "" });
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error adding user:", error);
      alert("Something went wrong!");
    }
  };
  
// 🟢 Fetch Online Users
const fetchOnlineUsers = useCallback(async () => {
  try {
      const res = await axios.get(`${BASE_URL}/check/online-users`, {
          headers: { Authorization: `Bearer ${token}` },
      });

      const now = DateTime.now().setZone("America/New_York");

      const updatedUsers = res.data.map(user => {
        if (user.checkin_time) {
          const checkinDate = DateTime.fromFormat(user.checkin_time, "yyyy-MM-dd HH:mm:ss", {
            zone: "America/New_York",
          });

          if (!checkinDate.isValid) {
          console.error("Invalid checkin_time:", user.checkin_time);
          return { ...user, checkinDuration: "Unknown" };
        }
        const diffMinutes = now.diff(checkinDate, ["hours", "minutes"]);
        const hours = Math.floor(diffMinutes.hours);
        const minutes = Math.floor(diffMinutes.minutes);
        const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            return { ...user, checkinDuration: timeString };
          }
          return { ...user, checkinDuration: "Just now" };
      });

      setOnlineUsers(updatedUsers);
  } catch (error) {
      console.error("Error fetching online users:", error);
  }
}, [token]);

 // 🟢 Listen for Check-In Notifications (For Admin Only)
 useEffect(() => {
  if (user?.name === "Md Hassan") {
    socket.on("newCheckIn", (data) => {
      setNotifications((prev) => [data.message, ...prev]);
    });

    return () => {
      socket.off("newCheckIn");
    };
  }
}, [user]);

// 🟢 Auto-Update Online Users Every 10s
useEffect(() => {
  fetchOnlineUsers();
  const interval = setInterval(fetchOnlineUsers, 10000);
  return () => clearInterval(interval);
}, [fetchOnlineUsers]);

  return (
    <div className="container">
      {/* ✅ Show Login Page if Token is Missing */}
      {!token ? (
        <Login setToken={setToken} />
      ) : (
        <div className="dashboard">
          <h2>Welcome, <span
          style={{ color: "blue", textDecoration: "underline", cursor: "pointer" }}
          onClick={handleShowModal}
        >
          {user?.name || "Guest"}
        </span>
        <UpdatePasswordModal
        show={showModal}
        onClose={() => setShowModal(false)}
        userId={userId}
        token={token}
      />
            {/* {user?.name || "Guest"} */}
            </h2>
          {/* 🔹 Admin Panel (If User is Admin) */}
          {user?.name === "Md Hassan" ? (
            <div className="main-content">
              {/* Left Panel: Admin Actions */}
              <div className="admin-panel">
              <h3>Admin Panel</h3>
              {/* 🟢 Notifications (Admin Only) */}
              {notifications.length > 0 &&(
              <div className="notifications">
              <button className="bell">
                  🔔 {notifications.length > 0 && <span className="badge">{notifications.length}</span>}
              </button>
                <div className="notifictiondropdown">
                <button className="bell">🔔 {notifications.length > 0 && <span className="badge">{notifications.length}</span>}</button>
                <div className="notification-dropdown">
                      {notifications.length > 0 ? notifications.map((msg, index) => <p key={index}>{msg}</p>) : <p>No new notifications</p>}
                </div>
               </div>
               </div>
              )}
              {/* 🟢 Add User */}
              <button onClick={() => setShowAddUser(!showAddUser)} className="button success">Add User</button>
              {showAddUser && (
                <div className="add-user-form">
                  <input type="text" placeholder="Name" className="input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                  <input type="email" placeholder="Email" className="input" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                  <button onClick={handleAddUser} className="button primary">Register</button>
                  {/* 🟢 Show Generated Password */}
                  {generatedPassword && (
                    <div className="generated-password">
                      <label>User's Password is: <strong>{generatedPassword}</strong></label>
                    </div>
                  )}
                </div>
              )}
              {/* 🟢 User Selection */}
              <div style={{ textAlign: "left", width: "100%" }}>
                <label>Select User</label>
                <select 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)} 
                className="dropdown"
              >
                <option value="">Select User</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              </div>
              {/* 🟢 Date Pickers */}
              <div style={{ textAlign: "left", width: "100%" }}>
                <label>From Date</label>
              </div>
              <input type="date" className="date-picker" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <div style={{ textAlign: "left", width: "100%" }}>
                <label>To Date</label>
              </div>
              <input type="date" className="date-picker" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              
              {/* 🟢 Fetch History Button */}
              <button onClick={fetchHistory} className="button success">Show History</button>
              </div>
              {/* Right Panel: 🟢 History Section (Only Shows if Data Exists) */}
              {
                historyData.length > 0 && (
                  <div className="history-panel">
                    <h2>History Table</h2>
                  <table className="history-table">
                  <thead>
                    <tr>
                    <th style={{ textAlign: "left" }}>Check-In Time</th>
                    <th style={{ textAlign: "right" }}>Check-Out Time</th>
                    <th style={{ textAlign: "right" }}>Duration</th>
                    <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((entry,index) => (
                      <tr key={entry.id || index}>
                        <td style={{ textAlign: "left" }}>{new Date(entry.checkin_time).toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>{new Date(entry.checkout_time).toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>{entry.duration}</td>
                        <td>
                          <button onClick={() => handleEdit(entry)}>✏️ Edit</button>
                      </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                )}
                {/* 🔹 Modal for Editing Check-Out Time */}
                {editEntry &&(
                    <div className="modal-overlay">
                      <div className="modal">
                      <h2>Edit Check-Out Time</h2>
                      <input 
                            type="datetime-local" 
                            value={editEntry.checkout_time || ""}
                            className="date-picker"
                            onChange={(e) => setEditEntry({ ...editEntry, checkout_time: e.target.value })}
                        />
                        <div className="modal-buttons">
                            <button onClick={handleSave}>✅ Save</button>
                            <button onClick={handleClose}>❌ Cancel</button>
                        </div>
                        </div>
                      </div>
                  )}
              {historyData === null ? null : historyData.length === 0 && <p></p>}
              {/* 🟢 Show Online Users */}
            <div className={`online-users-container ${isOnlineUsersOpen ? "active" : ""}`}>
              <button className="toggle-online-users" onClick={() => setIsOnlineUsersOpen(!isOnlineUsersOpen)}>
                Online Users
              </button>
                {/* <h3>Online Users</h3> */}
              <div className="online-users-list">
                {onlineUsers.length > 0 ? (
                  <ul>
                    {onlineUsers.map((user) => (
                    <li key={user.id}>
                      <span className={`user-status ${user.isCheckedIn ? "online" : "offline"}`}></span>
                      {user.name} <span className="dim-text">{user.checkinDuration}</span>
                    </li>
                  ))}
                  </ul>
                ) : (
                  <p>No users are currently checked in.</p>
                )}
              </div>
              </div>
              </div>
          ) : (
            <button onClick={handleCheckInOut} className="button primary">
              {isCheckedIn ? "Check Out" : "Check In"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
export default App;