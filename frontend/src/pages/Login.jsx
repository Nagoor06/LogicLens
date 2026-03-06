import { useState } from "react";
import { loginUser } from "../api";

function Login({ setLoggedIn }) {

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");

  const login = async () => {
    try {

      const res = await loginUser(email,password);

      localStorage.setItem("token", res.data.access_token);

      setLoggedIn(true);

    } catch {
      alert("Invalid credentials");
    }
  };

  return (

    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">

      <div className="bg-slate-900 p-8 rounded-xl w-[360px] shadow-xl">

        <h2 className="text-xl font-semibold mb-4 text-center">
          Login to LogicLens
        </h2>

        <input
          className="w-full p-2 mb-3 bg-slate-800 rounded"
          placeholder="Email"
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full p-2 mb-4 bg-slate-800 rounded"
          placeholder="Password"
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button
          onClick={login}
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded"
        >
          Login
        </button>

        <p className="text-xs text-center text-slate-400 mt-3">
          AI review requires authentication
        </p>

      </div>

    </div>

  );
}

export default Login;