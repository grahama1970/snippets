# Setting Up Python Project with UV Package Manager

  

UV is a fast Python package installer and resolver, written in Rust. This guide will help you set up a Python project using uv.

  

## Prerequisites

  

### 1. Install UV

On Ubuntu/Debian:

```bash

# Install curl if not already installed

sudo apt-get update

sudo apt-get install curl

  

# Install uv

curl -LsSf https://astral.sh/uv/install.sh | sh

  

# Add uv to PATH (if needed)

export PATH="$HOME/.cargo/bin:$PATH"

source ~/.profile

```

  

### 2. Install Python 3.11 (if needed)

```bash

# Add deadsnakes PPA

sudo add-apt-repository ppa:deadsnakes/ppa

sudo apt-get update

  

# Install Python 3.11

sudo apt-get install python3.11 python3.11-venv

```

  

## Project Setup

  

### 1. Create Virtual Environment

```bash

# Remove any existing venv

rm -rf .venv

  

# Create new venv with Python 3.11

uv venv --python=python3.11

  

# Activate the environment

source .venv/bin/activate

```

  

### 2. Verify Setup

```bash

# Check Python version

python --version

  

# Check pip location (should be in .venv)

which pip

  

# Check uv version

uv --version

```

  

### 3. Install Dependencies

```bash

# Install from requirements.txt

uv pip install -r requirements.txt

  

# For verbose output

uv pip install --verbose -r requirements.txt

```

  

## Usage Tips

  

### Installing Packages

```bash

# Install individual packages

uv pip install package_name

  

# Install with verbose output

uv pip install --verbose package_name

```

  

### Managing Requirements

```bash

# Update requirements.txt after adding new packages

uv pip freeze > requirements.txt

  

# List installed packages

uv pip list

  

# Show details for a specific package

uv pip show package_name

```

  

## Important Notes

  

1. Always use `uv pip` instead of just `pip`

2. UV provides minimal output by default - use `--verbose` for more details

3. Always activate your virtual environment before using uv

4. UV is significantly faster than pip but shows less progress information

5. The `.uv` directory contains UV's metadata and cache

  

## Project Structure

```

vllm_lora/

├── .venv/ # Virtual environment directory

├── .uv/ # UV metadata and cache

├── requirements.txt # Project dependencies

└── .gitignore # Should include .venv/ and .uv/

```

  

## Troubleshooting

  

If `which pip` shows system pip (`/usr/bin/pip`) instead of the virtual environment pip:

1. Deactivate any active virtual environments

2. Remove the existing .venv directory

3. Create a new virtual environment following the steps above

4. Ensure proper activation of the virtual environment

  

Remember to always verify the virtual environment is activated by checking for the `(.venv)` prefix in your terminal prompt.