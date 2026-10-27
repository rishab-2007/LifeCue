import { createBrowserRouter } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Planner from "./pages/Planner";
import Habits from "./pages/Habits";
import Focus from "./pages/Focus";
import Goals from "./pages/Goals";
import Analytics from "./pages/Analytics";
import Notes from "./pages/Notes";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },

  {
    path: "/register",
    element: <Register />,
  },

  {
    path: "/dashboard",
    element: <Dashboard />,
  },

  {
    path: "/tasks",
    element: <Tasks />,
  },

  {
    path: "/planner",
    element: <Planner />,
  },

  {
    path: "/habits",
    element: <Habits />,
  },

  {
    path: "/focus",
    element: <Focus />,
  },

  {
    path: "/goals",
    element: <Goals />,
  },

  {
    path: "/analytics",
    element: <Analytics />,
  },

  {
    path: "/notes",
    element: <Notes />,
  },
]);

export default router;