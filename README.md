# NPM Package to Nexus Uploader

A simple tool built with React (frontend) and Node.js (backend) to help you pack NPM packages from the public registry and publish them easily to a private Nexus repository.

---

## Table of Contents

- [Features](#features)  
- [Prerequisites](#prerequisites)  
- [Setup](#setup)  
  - [Backend Setup](#backend-setup)  
  - [Frontend Setup](#frontend-setup)  
- [Usage](#usage)  
- [Configuration](#configuration)  
- [Troubleshooting](#troubleshooting)  
- [License](#license)  
- [Author](#author)  

---

## Features

- Search and pack any public NPM package by name and version.
- Automatically fetch available versions for your package.
- Publish the selected package version tarball to your Nexus repository.
- Handles Nexus authentication securely using environment variables.
- User-friendly interface with status and error messages.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later recommended)
- [npm](https://www.npmjs.com/get-npm) (comes with Node.js)
- Access to a Nexus repository with npm hosted repository configured
- Nexus credentials with permissions to publish packages

---

## Setup

### Backend Setup

1. Clone the repository and navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create a `.env` file in the backend directory with the following variables:

   ```env
   NEXUS_USERNAME=your-nexus-username
   NEXUS_PASSWORD=your-nexus-password
   PORT=4000
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the backend server:

   ```bash
   npm start
   ```

   The backend API will run at `http://localhost:4000`.

---

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the React development server:

   ```bash
   npm start
   ```

4. Open your browser and visit [http://localhost:3000](http://localhost:3000).

---

## Usage

1. **Enter the NPM package name** you want to pack in the input box.
2. **Press Enter** to fetch and display all available versions in a dropdown.
3. **Select the version** you want to pack from the dropdown.
4. Click the **"NPM Pack"** button to generate the tarball.
5. Enter your **Nexus repository URL** (e.g., `https://nexus.example.com/repository/npm-hosted/`).
6. Select the packed tarball from the **dropdown list**.
7. Click **"Publish Selected Tarball"** to publish the package to Nexus.
8. View status messages for success or errors.

---

## Configuration

- **Backend Environment Variables**: Stored in `.env` file for Nexus credentials and port.
- **Frontend**: Configure backend API URL if needed (`http://localhost:4000` by default).
- **Nexus Repository URL**: Should be the full URL of your npm-hosted Nexus repository.

---

## Troubleshooting

- **Authentication errors**: Verify your Nexus username and password in `.env`.
- **Publish version already exists**: Nexus does not allow publishing the same version twice. Use a different version or bump the package version.
- **Network issues**: Ensure your machine can access both the public NPM registry and your Nexus server.
- **Invalid Nexus URL**: Double-check your Nexus repository URL format.

---

## License

This project is licensed under the MIT License.

---

## Author

Your Name – [GitHub Profile](https://github.com/yourusername)

---

Feel free to open issues or submit pull requests!
