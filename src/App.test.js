import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders AR view container", () => {
  render(<App />);
  expect(screen.getByTestId("ar-view")).toBeInTheDocument();
});
