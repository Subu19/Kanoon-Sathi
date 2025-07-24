# Kanoon Sathi

A simple guide to set up and run this project.

## Setup Guide

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)
- Git

### Installation
1. Clone the repository
   ```
   git clone <repository-url>
   cd kanoon-sathi
   ```

2. Install dependencies
   ```
   npm install
   ```

### Development
- Build the TypeScript code and run the application:
   ```
   npm run dev
   ```

- Build TypeScript code only:
   ```
   npm run build
   ```

- Run the compiled code:
   ```
   npm run start
   ```

### Code Quality
- Lint your code with Biome:
   ```
   npm run lint
   ```

- Format your code with Biome:
   ```
   npm run format
   ```

> **Note:** The project uses Git hooks (via Husky) to automatically lint and format code before each commit.

## Project Structure
- `src/`: TypeScript source code
- `dist/`: Compiled JavaScript (generated after build)
- `tsconfig.json`: TypeScript configuration
- `biome.json`: Biome configuration for linting and formatting
