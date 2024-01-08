# fame_engine
The `fame_engine` is a package that integrates the [bpmn-engine](https://github.com/paed01/bpmn-engine) in a ROS node.
The package defines:

 - The `splitter node` is in charge of getting a BPMN collaboration, create single models for each participant and share them with the related robots.
 - The `engine node` can be deployed into each robot and is able to receive a process and execute it.


## System launch
The launch file executed in a real robot looks like:

```python
...

def generate_launch_description():
    use_sim_time = LaunchConfiguration('use_sim_time', default='false')
    share_directory = get_package_share_directory('fame_engine')
    # set the path of your nodejs start file
    start_js_file = os.path.join(
        share_directory,
        'dist',
        'controller.js')

    start_robot_engine_node = Node(
        name='engine_node',
        executable='node',
        output='screen',
        namespace='ROBOT_NAME',
        parameters=[{'use_sim_time': use_sim_time}],
        arguments=[
            start_js_file
        ],
        cwd=share_directory)

    ld = LaunchDescription()
    ld.add_action(start_robot_engine_node)

    return ld
```

**Package initialization**:
```bash
cd fame_engine
colcon build
source install/setup.bash
```

**Node execution**:
```bash
ros2 launch fame_engine <file_name>.py
```
