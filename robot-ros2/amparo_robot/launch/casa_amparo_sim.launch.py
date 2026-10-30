"""Simulação completa: Gazebo (casa Amparo) + TurtleBot3 + slam_toolbox + Nav2 + robô assistente.

    export TURTLEBOT3_MODEL=waffle
    ros2 launch amparo_robot casa_amparo_sim.launch.py
    ros2 launch amparo_robot casa_amparo_sim.launch.py gui:=false rviz:=false   # sem janelas
"""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (AppendEnvironmentVariable, DeclareLaunchArgument, IncludeLaunchDescription,
                            SetEnvironmentVariable, TimerAction)
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    pkg = get_package_share_directory("amparo_robot")
    tb3_gazebo = get_package_share_directory("turtlebot3_gazebo")
    ros_gz_sim = get_package_share_directory("ros_gz_sim")
    nav2_bringup = get_package_share_directory("nav2_bringup")
    slam_toolbox = get_package_share_directory("slam_toolbox")

    world = os.path.join(pkg, "worlds", "casa_amparo.sdf")
    params = os.path.join(pkg, "config", "amparo_robot.yaml")
    gui = LaunchConfiguration("gui")
    rviz = LaunchConfiguration("rviz")

    def include(package_dir, *path, **arguments):
        return IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(package_dir, *path)),
            launch_arguments=arguments.items(),
        )

    return LaunchDescription([
        DeclareLaunchArgument("gui", default_value="true", description="Abrir a janela do Gazebo"),
        DeclareLaunchArgument("rviz", default_value="true", description="Abrir o RViz com o mapa do SLAM"),
        SetEnvironmentVariable("TURTLEBOT3_MODEL", os.environ.get("TURTLEBOT3_MODEL", "waffle")),
        AppendEnvironmentVariable("GZ_SIM_RESOURCE_PATH", os.path.join(tb3_gazebo, "models")),

        # 1. Mundo da casa + robô
        include(ros_gz_sim, "launch", "gz_sim.launch.py", gz_args=f"-r -s -v2 {world}", on_exit_shutdown="true"),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(ros_gz_sim, "launch", "gz_sim.launch.py")),
            launch_arguments={"gz_args": "-g -v2"}.items(),
            condition=IfCondition(gui),
        ),
        include(tb3_gazebo, "launch", "robot_state_publisher.launch.py", use_sim_time="true"),
        include(tb3_gazebo, "launch", "spawn_turtlebot3.launch.py", x_pose="0.0", y_pose="0.0"),

        # 2. SLAM (mapa sendo construído em tempo real) + Nav2 (planejamento e desvio de obstáculos)
        TimerAction(period=5.0, actions=[
            include(slam_toolbox, "launch", "online_async_launch.py", use_sim_time="true"),
            include(nav2_bringup, "launch", "navigation_launch.py", use_sim_time="true",
                    params_file=os.path.join(nav2_bringup, "params", "nav2_params.yaml")),
        ]),
        TimerAction(period=7.0, actions=[
            Node(package="rviz2", executable="rviz2", output="screen", condition=IfCondition(rviz),
                 arguments=["-d", os.path.join(nav2_bringup, "rviz", "nav2_default_view.rviz")],
                 parameters=[{"use_sim_time": True}]),
        ]),

        # 3. Robô assistente: decisão (patrulha / socorro / comandos) + ponte com o backend
        TimerAction(period=10.0, actions=[
            Node(package="amparo_robot", executable="mission_manager", output="screen",
                 parameters=[params, {"use_sim_time": True}]),
        ]),
    ])
