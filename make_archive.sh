# Create a temporary directory
mkdir all_mp3s

# Find and copy all .mp3 files to the temporary directory while preserving the filename
find . -type f -iname "*.mp3" -exec bash -c 'cp "{}" "all_mp3s/$(basename "{}")"' \;

# Create a zip archive containing the files in the temporary directory
zip -r all_mp3s.zip all_mp3s
