import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { LoginScreen } from './LoginScreen'
import { useLogin } from '@project/sdk'
import { setToken } from '../../../lib/authToken'
import { queryClient } from '../../../lib/queryClient'

// Mock dependencies
jest.mock('@project/sdk', () => ({
  useLogin: jest.fn(),
}))

jest.mock('../../../lib/authToken', () => ({
  setToken: jest.fn(),
}))

jest.mock('../../../lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}))

describe('LoginScreen', () => {
  it('successfully logs in with valid credentials', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue({ token: 'fake-token' })
    ;(useLogin as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })

    const mockNavigation = { navigate: jest.fn() } as any

    const { getByTestId } = render(<LoginScreen navigation={mockNavigation} route={{} as any} />)

    const emailInput = getByTestId('login.email')
    const passwordInput = getByTestId('login.password')
    const submitButton = getByTestId('login.submit')

    // Initial state: button should be disabled
    expect(submitButton).toBeDisabled()

    // Fill in the form
    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.changeText(passwordInput, 'password123')

    // Button should now be enabled
    expect(submitButton).not.toBeDisabled()

    // Submit the form
    fireEvent.press(submitButton)

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
      expect(setToken).toHaveBeenCalledWith('fake-token')
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['me'] })
    })
  })
})
