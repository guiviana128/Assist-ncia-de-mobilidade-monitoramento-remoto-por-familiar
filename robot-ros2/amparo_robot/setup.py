from glob import glob

from setuptools import find_packages, setup

package_name = "amparo_robot"

setup(
    name=package_name,
    version="1.0.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
        ("share/" + package_name + "/launch", glob("launch/*.launch.py")),
        ("share/" + package_name + "/worlds", glob("worlds/*.sdf")),
        ("share/" + package_name + "/config", glob("config/*.yaml")),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="Equipe Amparo Telecuidado",
    maintainer_email="gustavoribeirosantos13@gmail.com",
    description="Robô assistente da casa Amparo (ROS 2 Jazzy + Nav2 + slam_toolbox)",
    license="MIT",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "mission_manager = amparo_robot.mission_manager_node:main",
            "generate_world = amparo_robot.generate_world:main",
        ],
    },
)
