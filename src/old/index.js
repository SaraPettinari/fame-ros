
'use strict'; 

const rclnodejs = require('rclnodejs');

;(async function main() {
  
  example();

})().catch(() => {
  process.exitCode = 1
})


// Create a node that publisher a msg to the topic 'foo' every 1 second.
// View the topic from the ros2 commandline as shown below:
//   ros2 topic echo foo std_msgs/msg/String
async function example() {
 
  await rclnodejs.init();
  let node = rclnodejs.createNode('MyNode');
  
  // Create main working components here, e.g., publisher, subscriber, service, client, action
  // For example, a publisher sending a msg every 1 sec
  let publisher = node.createPublisher('std_msgs/msg/String', 'foo');
  let cnt = 0;
  let msg = rclnodejs.createMessageObject('std_msgs/msg/String');
  let timer = node.createTimer(1000, () => {
    msg.data = `msg: ${++cnt}`
    publisher.publish(msg);
  });

  rclnodejs.spin(node);
}
