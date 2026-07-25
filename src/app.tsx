import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import OrderFormPage from "@/pages/OrderForm/OrderFormPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OrderFormPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
