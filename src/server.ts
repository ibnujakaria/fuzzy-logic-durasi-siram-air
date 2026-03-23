import { app } from "./app";

const PORT = 3780;

app.listen(PORT, () => {
  console.log("Server berjalan di http://localhost:" + PORT);
});
