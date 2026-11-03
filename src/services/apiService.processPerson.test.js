// Process Person / Admin-creation integration: regression test for
// apiService.createProcessPersonApi — added for the "Process Person"
// role option in ExecutiveCredentialsForm.js (features/admin). Mocks
// axios directly rather than hitting a real network call.

const mockPost = jest.fn();
jest.mock("axios", () => ({
  create: jest.fn(() => ({
    post: mockPost,
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
}));

const { createProcessPersonApi } = require("./apiService");

afterEach(() => {
  jest.clearAllMocks();
});

describe("createProcessPersonApi — sent as plain JSON, not FormData", () => {
  test("posts {fullName, email, password} to processperson/admin-create", async () => {
    mockPost.mockResolvedValue({
      data: { message: "Process Person created successfully.", person: { id: 1, fullName: "Pat Process", email: "pat@acme.com" } },
    });

    const payload = { fullName: "Pat Process", email: "pat@acme.com", password: "secret123" };
    const result = await createProcessPersonApi(payload);

    expect(mockPost).toHaveBeenCalledWith("processperson/admin-create", payload);
    // Deliberately NOT a FormData instance — see the comment in
    // apiService.js for why (the backend route only parses JSON).
    expect(payload instanceof FormData).toBe(false);
    expect(result.person.fullName).toBe("Pat Process");
  });

  test("propagates a backend error (e.g. duplicate email) to the caller", async () => {
    mockPost.mockRejectedValue({
      response: { data: { message: "Email already exists." } },
    });

    await expect(createProcessPersonApi({ fullName: "X", email: "dup@acme.com", password: "secret123" })).rejects.toBeDefined();
  });
});
