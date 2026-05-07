import { useState } from "react";

interface Props {
  employeeId: number;
  name: string;
  size?: number;
}

export default function EmployeeAvatar({ employeeId, name, size = 40 }: Props) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (failed) {
    return (
      <div
        className="employee-avatar employee-avatar--fallback"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      className="employee-avatar"
      src={`/api/employees/${employeeId}/avatar`}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  );
}
