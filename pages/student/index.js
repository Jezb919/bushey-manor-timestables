import { useEffect } from "react";

export default function StudentIndex() {
  useEffect(() => {
    window.location.href = "/student/login";
  }, []);

  return null;
}
