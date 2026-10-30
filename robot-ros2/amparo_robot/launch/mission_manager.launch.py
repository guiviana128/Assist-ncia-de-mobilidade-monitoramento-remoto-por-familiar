"""Somente o robô assistente (use quando Gazebo/Nav2 já estiverem rodando)."""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    params = os.path.join(get_package_share_directory("amparo_robot"), "config", "amparo_robot.yaml")
    return LaunchDescription([
        Node(package="amparo_robot", executable="mission_manager", output="screen",
             parameters=[params, {"use_sim_time": True}]),
    ])
