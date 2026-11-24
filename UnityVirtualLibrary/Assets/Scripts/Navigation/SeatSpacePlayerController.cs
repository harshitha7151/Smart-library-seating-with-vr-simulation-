using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public sealed class SeatSpacePlayerController : MonoBehaviour
{
    public Camera viewCamera;
    public float walkSpeed = 3.2f;
    public float sprintSpeed = 5.0f;
    public float mouseSensitivity = 2.0f;
    public float gravity = 18f;

    private CharacterController controller;
    private float pitch;

    private void Awake()
    {
        controller = GetComponent<CharacterController>();
        if (viewCamera == null) viewCamera = GetComponentInChildren<Camera>();
    }

    private void Update()
    {
        if (viewCamera == null || controller == null) return;
        var direction = Vector3.zero;
        if (Input.GetKey(KeyCode.W)) direction += viewCamera.transform.forward;
        if (Input.GetKey(KeyCode.S)) direction -= viewCamera.transform.forward;
        if (Input.GetKey(KeyCode.D)) direction += viewCamera.transform.right;
        if (Input.GetKey(KeyCode.A)) direction -= viewCamera.transform.right;
        direction.y = 0f;
        if (direction.sqrMagnitude > 1f) direction.Normalize();
        var speed = Input.GetKey(KeyCode.LeftShift) ? sprintSpeed : walkSpeed;
        var motion = direction * speed;
        motion.y = controller.isGrounded ? -1f : -gravity * Time.deltaTime;
        controller.Move(motion * Time.deltaTime);

        if (Input.GetMouseButton(1))
        {
            var lookX = Input.GetAxis("Mouse X") * mouseSensitivity;
            var lookY = Input.GetAxis("Mouse Y") * mouseSensitivity;
            transform.Rotate(0f, lookX, 0f);
            pitch = Mathf.Clamp(pitch - lookY, -80f, 80f);
            viewCamera.transform.localRotation = Quaternion.Euler(pitch, 0f, 0f);
        }
    }
}
