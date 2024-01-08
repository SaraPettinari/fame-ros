
import os

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from ament_index_python.packages import get_package_share_directory


def generate_launch_description():

    use_sim_time = LaunchConfiguration('use_sim_time', default='false')

    share_directory = get_package_share_directory('fame_engine')

    # path to nodejs start file
    start_js_file = os.path.join(
        share_directory,
        'dist',
        'controller.js')

    drone_node = Node(
        name='engine_node',
        executable='node',
        output='screen',
        namespace='Drone',
        parameters=[{'use_sim_time': use_sim_time}],
        arguments=[
            start_js_file
        ],
        cwd=share_directory)

    tractor1_node = Node(
        name='engine_node',
        executable='node',
        output='screen',
        namespace='Tractor_1',
        parameters=[{'use_sim_time': use_sim_time}],
        arguments=[
            start_js_file
        ],
        cwd=share_directory)

    tractor2_node = Node(
        name='engine_node',
        executable='node',
        output='screen',
        namespace='Tractor_2',
        parameters=[{'use_sim_time': use_sim_time}],
        arguments=[
            start_js_file
        ],
        cwd=share_directory)

    tractor3_node = Node(
        name='engine_node',
        executable='node',
        output='screen',
        namespace='Tractor_3',
        parameters=[{'use_sim_time': use_sim_time}],
        arguments=[
            start_js_file
        ],
        cwd=share_directory)

    start_splitter_file = os.path.join(
        share_directory,
        'dist',
        'splitter.js')

    start_splitter_node = Node(
        name='engine_node',
        executable='node',
        output='screen',
        parameters=[{'use_sim_time': use_sim_time}],
        arguments=[
            start_splitter_file
        ],
        cwd=share_directory)

    ld = LaunchDescription()
    ld.add_action(drone_node)
    ld.add_action(tractor1_node)
    ld.add_action(tractor2_node)
    #ld.add_action(tractor3_node)

   # ld.add_action(start_splitter_node)

    return ld
