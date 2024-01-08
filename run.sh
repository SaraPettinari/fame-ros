#!/bin/sh

#source install/setup.bash
clear
colcon build
ros2 launch fame_engine example.launch.py