import config from "./config";  // ✅ Import Config
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Login from "./Login";
import "./App.css";
const BASE_URL = config.BASE_URL;  // ✅ Use BASE_URL from config

const App = () => {
  
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [history, setHistory] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
// 🟢 Add User Form State
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "" });
  const [generatedPassword, setGeneratedPassword] = useState(null);
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

      console.log("Fetched Users:", res.data);

      if (!res.data || res.data.length === 0) {
        console.warn("No users found!");
        return;
      }

      // Filter out the admin
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
  const fetchHistory = async () => {
    if (!selectedUser || !fromDate || !toDate) {
      alert("Please select a user and provide a date range!");
      return;
    }
    try {
      const res = await axios.get(`${BASE_URL}/check/history/`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {user_id: selectedUser, start_date: fromDate, end_date:toDate },
      });
      setHistory(res.data);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

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
  // 🟢 Logout Function
  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setIsCheckedIn(false);
  };
  return (
    <div className="app-container">
      {!token ? (
        <Login setToken={setToken} />
      ) : (
        <div className="dashboard">
          <h2>Welcome, {user?.name || "Guest"}</h2>
          {user?.name === "Md Hassan" ? (
            <div className="admin-panel">
              <h3>Admin Panel</h3>
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
              {/* 🟢 Dropdown to Select User */}
              <div style={{ textAlign: "left", width: "100%" }}>
                <label>Select User</label>
              </div>
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
              
              {/* 🟢 History Section */}
              {
                history.length > 0 && (
                  <table className="history-table">
                  <thead>
                    <tr>
                    <th style={{ textAlign: "left" }}>Check-In Time</th>
                    <th style={{ textAlign: "right" }}>Check-Out Time</th>
                    <th style={{ textAlign: "right" }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record, index) => (
                      <tr key={index}>
                        <td>{record.checkin_time}</td>
                        <td>{record.checkout_time}</td>
                        <td>{record.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )
              }
              {history.length === 0 && <p>No history found.</p>}
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