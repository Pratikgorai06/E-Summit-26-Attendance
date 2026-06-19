# E-Summit 26 Attendance

A web application built to streamline and track attendee participation for E-Summit 26. 

Live Demo: [e-summit-26-attendance.vercel.app](https://e-summit-26-attendance.vercel.app/)

## 🛠 Tech Stack

* **Framework:** [Next.js](https://nextjs.org/) (App Router)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Backend & Database:** [Firebase](https://firebase.google.com/) (Firestore)
* **Deployment:** [Vercel](https://vercel.com/)

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
Make sure you have Node.js and npm (or your preferred package manager) installed.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/Pratikgorai06/E-Summit-26-Attendance.git](https://github.com/Pratikgorai06/E-Summit-26-Attendance.git)
    cd E-Summit-26-Attendance
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    * Create a `.env.local` file in the root directory.
    * Add your Firebase configuration keys (refer to `firebase.ts` to see which keys are required).

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure

* `/app`: Contains the core Next.js application routes and pages.
* `/hooks`: Custom React hooks.
* `/lib`: Utility functions and reusable library code.
* `firebase.ts` / `firestore.rules`: Firebase initialization and database security rules.

## 📝 License
This project is for E-Summit 26.
