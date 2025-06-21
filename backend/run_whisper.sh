#!/bin/bash
# Activate conda env manually
source /opt/homebrew/Caskroom/miniconda/base/etc/profile.d/conda.sh
conda activate superheroes
python3 whisper_worker/transcribe.py "$1" "$2"
