#!/bin/sh
set -e

if [ "$(id -u)" -eq 0 ]; then
    echo "Run me as a normal user, not root!"
    exit 1
fi

misc_dir="$HOME/misc" # Install to ~/misc suggested by thororen  --PhoenixAceVFX: This is alot better than what I could write even if I just edited a fork
mkdir -p "$misc_dir"

installer_path="$misc_dir/EquilotlCli-Linux"
github_url="https://github.com/Equicord/Equilotl/releases/latest/download/EquilotlCli-Linux"

echo "Checking if the installer needs updating..."


latest_modified=$(curl -sI "https://github.com/Equicord/Equilotl/releases/latest/download/EquilotlCli-Linux" | grep -i "last-modified" | cut -d' ' -f2-)

if [ -f "$installer_path" ]; then
    # Get time of last modification 
    local_modified=$(stat -c "%y" "$installer_path" | cut -d' ' -f1-2)

# kinda shitty way to update but it kinda works ig 
    if [ "$local_modified" = "$latest_modified" ]; then
        echo "The installer is up-to-date."
    else
        echo "The installer is outdated. Downloading the latest version..."
        curl -sSL "https://github.com/Equicord/Equilotl/releases/latest/download/EquilotlCli-Linux" --output "$installer_path"
        chmod +x "$installer_path"
    fi
else
    echo "Installer not found. Downloading it..."
    curl -sSL "https://github.com/Equicord/Equilotl/releases/latest/download/EquilotlCli-Linux" --output "$installer_path"
    chmod +x "$installer_path"
fi


if command -v sudo >/dev/null; then
    echo "Running installer with sudo..."
    sudo "$installer_path"
elif command -v doas >/dev/null; then
    echo "Running installer with doas..."
    doas "$installer_path"
else
    echo "Neither sudo nor doas were found. Please install one to proceed."
    exit 1
fi
echo "Original script forked from Vencord"
echo "Modified by PhoenixAceVFX for Equicord"
echo "Modified by Crxaw for Updater System"
